'use client';

import { useState, useEffect } from 'react';
import { getRoles, getRoleWithPermissions, updateRolePermissions, createRole, deleteRole } from '@/actions/roles';
import { MODULES } from '@/lib/modules';
import { Users, Shield, Plus, Trash2, Check, X, Loader2, Lock, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Role {
    id: string;
    name: string;
    description: string | null;
    is_system_role: boolean;
}

interface Permission {
    module: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
    can_approve: boolean;
}

export default function UsuariosPage() {
    const { toast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Dialog states
    const [showNewRoleDialog, setShowNewRoleDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDescription, setNewRoleDescription] = useState('');

    useEffect(() => {
        loadRoles();
    }, []);

    useEffect(() => {
        if (selectedRole) {
            loadPermissions(selectedRole);
        }
    }, [selectedRole]);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const data = await getRoles();
            setRoles(data);
            if (data.length > 0 && !selectedRole) {
                setSelectedRole(data[0].id);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los roles',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const loadPermissions = async (roleId: string) => {
        try {
            const data = await getRoleWithPermissions(roleId);
            if (data?.permissions) {
                // Ensure all modules have permissions
                const permMap: Record<string, Permission> = {};
                for (const m of MODULES) {
                    permMap[m.id] = {
                        module: m.id,
                        can_read: false,
                        can_write: false,
                        can_delete: false,
                        can_approve: false,
                    };
                }
                for (const p of data.permissions) {
                    permMap[p.module] = p;
                }
                setPermissions(Object.values(permMap));
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
        }
    };

    const handlePermissionChange = (module: string, field: keyof Permission, value: boolean) => {
        setPermissions(prev => prev.map(p => 
            p.module === module ? { ...p, [field]: value } : p
        ));
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;
        
        setSaving(true);
        try {
            await updateRolePermissions(selectedRole, permissions);
            toast({
                title: 'Guardado',
                description: 'Permisos actualizados correctamente',
                variant: 'success',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron guardar los permisos',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) return;
        
        try {
            await createRole(newRoleName, newRoleDescription);
            toast({
                title: 'Rol creado',
                description: `El rol "${newRoleName}" ha sido creado`,
                variant: 'success',
            });
            setShowNewRoleDialog(false);
            setNewRoleName('');
            setNewRoleDescription('');
            loadRoles();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo crear el rol',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        try {
            await deleteRole(roleId);
            toast({
                title: 'Rol eliminado',
                description: 'El rol ha sido eliminado',
                variant: 'success',
            });
            setShowDeleteDialog(null);
            if (selectedRole === roleId) {
                setSelectedRole(null);
            }
            loadRoles();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo eliminar el rol',
                variant: 'destructive',
            });
        }
    };

    const currentRole = roles.find(r => r.id === selectedRole);

    return (
        <div data-testid="usuarios-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Usuarios y Roles</h1>
                <p className="text-gray-500 mt-1">Gestiona los roles y permisos del sistema</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Roles List */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Shield size={18} />
                            Roles
                        </h2>
                        <button
                            onClick={() => setShowNewRoleDialog(true)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Nuevo rol"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {roles.map((role) => (
                                <div
                                    key={role.id}
                                    onClick={() => setSelectedRole(role.id)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between group ${
                                        selectedRole === role.id
                                            ? 'bg-blue-50 border-2 border-blue-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {role.is_system_role && (
                                            <Lock size={14} className="text-gray-400" />
                                        )}
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">{role.name}</p>
                                            {role.description && (
                                                <p className="text-xs text-gray-500 truncate max-w-[150px]">
                                                    {role.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {!role.is_system_role && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(role.id); }}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Permissions Matrix */}
                <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-6">
                    {selectedRole ? (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Permisos: {currentRole?.name}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {currentRole?.description || 'Configura los permisos para este rol'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleSavePermissions}
                                    disabled={saving || currentRole?.is_system_role}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <Check size={16} />
                                    )}
                                    Guardar
                                </button>
                            </div>

                            {currentRole?.is_system_role && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                    <p className="text-sm text-yellow-800">
                                        <Lock className="inline mr-2" size={14} />
                                        Los roles del sistema no pueden ser modificados
                                    </p>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Módulo</th>
                                            <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Leer</th>
                                            <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Escribir</th>
                                            <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Eliminar</th>
                                            <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Aprobar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MODULES.map((module) => {
                                            const perm = permissions.find(p => p.module === module.id);
                                            return (
                                                <tr key={module.id} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <span>{module.icon}</span>
                                                            <span className="text-sm font-medium text-gray-900">{module.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center py-3 px-4">
                                                        <PermissionCheckbox
                                                            checked={perm?.can_read || false}
                                                            onChange={(v) => handlePermissionChange(module.id, 'can_read', v)}
                                                            disabled={currentRole?.is_system_role}
                                                        />
                                                    </td>
                                                    <td className="text-center py-3 px-4">
                                                        <PermissionCheckbox
                                                            checked={perm?.can_write || false}
                                                            onChange={(v) => handlePermissionChange(module.id, 'can_write', v)}
                                                            disabled={currentRole?.is_system_role}
                                                        />
                                                    </td>
                                                    <td className="text-center py-3 px-4">
                                                        <PermissionCheckbox
                                                            checked={perm?.can_delete || false}
                                                            onChange={(v) => handlePermissionChange(module.id, 'can_delete', v)}
                                                            disabled={currentRole?.is_system_role}
                                                        />
                                                    </td>
                                                    <td className="text-center py-3 px-4">
                                                        <PermissionCheckbox
                                                            checked={perm?.can_approve || false}
                                                            onChange={(v) => handlePermissionChange(module.id, 'can_approve', v)}
                                                            disabled={currentRole?.is_system_role}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Users size={48} className="mx-auto mb-4 text-gray-300" />
                            <p>Selecciona un rol para ver sus permisos</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New Role Dialog */}
            <Dialog open={showNewRoleDialog} onOpenChange={setShowNewRoleDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Rol</DialogTitle>
                        <DialogDescription>
                            Crea un nuevo rol personalizado para asignar a usuarios
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre del rol
                            </label>
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Ej: Supervisor de Ventas"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción
                            </label>
                            <textarea
                                value={newRoleDescription}
                                onChange={(e) => setNewRoleDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                rows={2}
                                placeholder="Descripción del rol..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <button
                            onClick={() => setShowNewRoleDialog(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreateRole}
                            disabled={!newRoleName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Crear Rol
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Role Dialog */}
            <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Eliminar Rol</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de eliminar este rol? Los usuarios con este rol perderán sus permisos asociados.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            onClick={() => setShowDeleteDialog(null)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => showDeleteDialog && handleDeleteRole(showDeleteDialog)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Eliminar
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PermissionCheckbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                checked 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-400'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
        >
            {checked ? <Check size={14} /> : <X size={14} />}
        </button>
    );
}
