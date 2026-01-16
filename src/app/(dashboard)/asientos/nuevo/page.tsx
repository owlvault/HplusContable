
import { JournalEntryForm } from '@/components/accounting/journal-entry-form';

export default function NewEntryPage() {
    return (
        <div className="container" style={{ maxWidth: '1000px' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Nuevo Asiento Contable</h1>
            <JournalEntryForm />
        </div>
    );
}
