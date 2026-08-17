/**
 * Distributed Circuit Breaker for DIAN SOAP/REST Web Services.
 * Protects against government infrastructure outages and classifies errors strictly:
 * - 5xx & Timeouts -> Trip Circuit to OPEN (triggers Contingencia 04 fallback)
 * - 4xx Validation / Business Errors -> DO NOT trip Circuit Breaker
 * - HALF_OPEN uses a Single Canary Probe lock to test DIAN recovery safely.
 */

export enum CircuitState {
    CLOSED = 'CLOSED',       // Normal operation with DIAN
    OPEN = 'OPEN',           // DIAN is down; immediately use Contingencia 04
    HALF_OPEN = 'HALF_OPEN', // Single canary probe testing DIAN recovery
}

export interface CircuitBreakerConfig {
    failureThreshold?: number; // Failures before tripping (default 5)
    recoveryTimeoutMs?: number; // Time before trying HALF_OPEN (default 60000ms)
    probeTimeoutMs?: number;    // Lock timeout for canary probe (default 10000ms)
}

export class DianCircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastTripTime: number = 0;
    private probeLockedUntil: number = 0;
    private readonly failureThreshold: number;
    private readonly recoveryTimeoutMs: number;
    private readonly probeTimeoutMs: number;

    constructor(config: CircuitBreakerConfig = {}) {
        this.failureThreshold = config.failureThreshold ?? 5;
        this.recoveryTimeoutMs = config.recoveryTimeoutMs ?? 60000;
        this.probeTimeoutMs = config.probeTimeoutMs ?? 10000;
    }

    public getState(): CircuitState {
        if (this.state === CircuitState.OPEN) {
            const elapsed = Date.now() - this.lastTripTime;
            if (elapsed > this.recoveryTimeoutMs) {
                // Window expired: transition to HALF_OPEN
                this.state = CircuitState.HALF_OPEN;
            }
        }
        return this.state;
    }

    public canExecute(): boolean {
        const currentState = this.getState();

        if (currentState === CircuitState.CLOSED) {
            return true;
        }

        if (currentState === CircuitState.HALF_OPEN) {
            const now = Date.now();
            // Single Canary Probe: acquire lock if not held or expired
            if (now > this.probeLockedUntil) {
                this.probeLockedUntil = now + this.probeTimeoutMs;
                return true; // This thread gets to be the single canary
            }
            return false; // Other requests fail fast while canary is running
        }

        // OPEN state
        return false;
    }

    public recordSuccess(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.probeLockedUntil = 0;
    }

    public recordFailure(error: unknown): void {
        const isInfra = DianCircuitBreaker.isInfrastructureError(error);

        if (!isInfra) {
            // Business / 4xx error: do not penalize DIAN infrastructure health
            return;
        }

        const currentState = this.getState();

        if (currentState === CircuitState.HALF_OPEN) {
            // Canary failed: immediate trip back to OPEN
            this.state = CircuitState.OPEN;
            this.lastTripTime = Date.now();
            this.probeLockedUntil = 0;
            return;
        }

        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.lastTripTime = Date.now();
        }
    }

    public static isInfrastructureError(error: unknown): boolean {
        if (!error) return false;

        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (
                msg.includes('timeout') ||
                msg.includes('econnrefused') ||
                msg.includes('econnreset') ||
                msg.includes('socket hang up') ||
                msg.includes('network') ||
                msg.includes('500') ||
                msg.includes('502') ||
                msg.includes('503') ||
                msg.includes('504')
            ) {
                return true;
            }
        }

        if (typeof error === 'object' && error !== null) {
            const status = (error as { status?: number; statusCode?: number }).status ?? 
                           (error as { status?: number; statusCode?: number }).statusCode;
            if (typeof status === 'number' && status >= 500) {
                return true;
            }
        }

        return false;
    }

    // Helper for testing
    public forceState(state: CircuitState, lastTrip: number = Date.now()): void {
        this.state = state;
        this.lastTripTime = lastTrip;
        this.failureCount = state === CircuitState.OPEN ? this.failureThreshold : 0;
    }
}

// Global Singleton for in-memory pod resilience
export const globalDianCircuitBreaker = new DianCircuitBreaker();
