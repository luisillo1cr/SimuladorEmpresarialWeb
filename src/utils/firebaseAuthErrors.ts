import type { FirebaseError } from 'firebase/app';

export function getFirebaseAuthErrorMessage(error: unknown) {
  const firebaseError = error as FirebaseError;

  switch (firebaseError.code) {
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'auth/user-not-found':
      return 'No existe un usuario con ese correo.';
    case 'auth/wrong-password':
      return 'La contraseña ingresada no es correcta.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Intenta nuevamente más tarde.';
    case 'auth/network-request-failed':
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    default:
      return 'No fue posible iniciar sesión. Intenta nuevamente.';
  }
}