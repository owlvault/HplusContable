import { redirect } from 'next/navigation';

// Redirect to main users/roles page
export default function ConfiguracionUsuariosRedirect() {
    redirect('/usuarios');
}
