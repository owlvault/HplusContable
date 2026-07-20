// Mapeo de errores de Supabase Auth a mensajes en español
const errorMessages: Record<string, string> = {
  // Auth errors
  'Invalid login credentials': 'Correo o contraseña incorrectos',
  'Email not confirmed': 'Por favor confirma tu correo electrónico',
  'User already registered': 'Este correo ya está registrado',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Unable to validate email address: invalid format': 'El formato del correo electrónico no es válido',
  'Signup requires a valid password': 'Se requiere una contraseña válida',
  'User not found': 'Usuario no encontrado',
  'Invalid email or password': 'Correo o contraseña incorrectos',
  'Email rate limit exceeded': 'Demasiados intentos. Por favor espera unos minutos',
  'For security purposes, you can only request this once every 60 seconds': 'Por seguridad, solo puedes solicitar esto una vez cada 60 segundos',
  'Token has expired or is invalid': 'El enlace ha expirado o no es válido',
  'New password should be different from the old password': 'La nueva contraseña debe ser diferente a la anterior',
  
  // Network errors
  'Failed to fetch': 'Error de conexión. Verifica tu internet',
  'Network request failed': 'Error de red. Intenta de nuevo',
  'fetch failed': 'Error de conexión. Verifica tu internet',
  
  // Generic
  'An error occurred': 'Ha ocurrido un error',
  'Server error': 'Error del servidor',
  'Unexpected error': 'Error inesperado',
};

export function getSpanishErrorMessage(error: string | Error | unknown): string {
  let message = '';
  
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  }
  
  // Buscar coincidencia exacta
  if (errorMessages[message]) {
    return errorMessages[message];
  }
  
  // Buscar coincidencia parcial
  for (const [key, value] of Object.entries(errorMessages)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Si contiene "password" o "contraseña"
  if (message.toLowerCase().includes('password')) {
    return 'Error con la contraseña. Verifica que sea correcta';
  }
  
  // Si contiene "email" o "correo"
  if (message.toLowerCase().includes('email')) {
    return 'Error con el correo electrónico';
  }
  
  // Retornar mensaje genérico si no hay coincidencia
  return message || 'Ha ocurrido un error inesperado';
}
