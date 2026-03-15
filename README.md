# Simulador Web - Panel Empresarial

> **Estado actual:** Stable **v1.0.0**  
> Proyecto privado y de uso restringido.

## Descripción

Simulador Web es una plataforma educativa orientada a prácticas empresariales.  
Permite administrar usuarios, equipos, empresas simuladas, operaciones mensuales y un panel personalizado para estudiantes según su puesto de trabajo.

La meta del sistema es ofrecer una simulación **fiel, usable y controlada** para entornos académicos, sin meter complejidad innecesaria.

## Estado de la versión

Esta versión se considera la **primera versión estable (`v1.0.0`)** porque ya incluye:

- autenticación e invitación de estudiantes
- roles y permisos básicos
- gestión de usuarios
- CRUD de equipos
- CRUD de empresas
- operación mensual
- dashboard administrativo
- dashboard de estudiante por puesto
- chat de equipo en tiempo real
- soporte para tema claro/oscuro
- layout responsive base

## Tecnologías principales

- **React**
- **TypeScript**
- **Vite**
- **Firebase Authentication**
- **Cloud Firestore**
- **Tailwind CSS**

## Módulos principales

### 1. Autenticación
- inicio de sesión
- flujo de invitación de estudiantes
- onboarding inicial
- sesión persistente

### 2. Usuarios
- administración de usuarios
- asignación de rol
- control de estado
- asignación de puesto estudiantil

### 3. Equipos
- creación de equipos de 1 a 3 estudiantes
- edición de integrantes
- disolución de equipos
- sincronización de chats por equipo

### 4. Empresas
- creación de empresas simuladas
- asignación a equipo
- control de estado legal/operativo
- cédula jurídica simulada

### 5. Operación mensual
- caja inicial
- ingresos
- gastos
- planilla
- impuesto simplificado
- resultado neto
- estado del período

### 6. Dashboard
- vista administrativa
- vista estudiantil por puesto
- semáforo empresarial
- indicadores rápidos
- alertas e insights

### 7. Chat
- chat interno de equipo
- chat equipo ↔ profesor
- tiempo real
- borrado lógico de mensajes
- sonido discreto al recibir mensajes

## Roles del sistema

### Administrador
Acceso total al sistema.

### Profesor
Gestión académica/operativa sobre usuarios estudiantes, equipos y empresas.

### Estudiante
Acceso restringido a su equipo, empresa, operación y chats autorizados.

## Estructura base sugerida

```text
src/
  components/
    chat/
    layout/
    ui/
  hooks/
  pages/
  services/
    firebase/
    chat/
  types/
  utils/
```

## Requisitos para desarrollo local

- Node.js 18+
- npm
- proyecto Firebase configurado
- variables/configuración del frontend apuntando al proyecto correcto

## Comandos básicos

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Firebase

Este proyecto usa principalmente:

- Authentication
- Firestore

Si ya no estás usando Cloud Functions, no mantengas configuración sobrante en `firebase.json`.

## Repositorio y acceso

Este proyecto está pensado para manejarse como **repositorio privado**.

No debe considerarse open source.  
El código, archivos, estructura y lógica del sistema son de uso restringido según el archivo `LICENSE`.

## Recomendación para marcar la versión estable

Crear una release/tag:

```bash
git tag -a v1.0.0 -m "Stable v1.0.0"
git push origin v1.0.0
```

Luego en GitHub:
- crear release
- usar tag `v1.0.0`
- título recomendado: `Stable v1.0.0`

## Estado actual recomendado para demo

Apto para pruebas internas con estudiantes y validación académica controlada.

## Hoja de ruta sugerida

- chat individual estudiante ↔ profesor
- envío de imágenes en chat
- mejoras de unread counters
- ajustes finos UX/mobile
- módulos configurables por docente
- más métricas por puesto

## Autor

**Luis David Solórzano Montero**

Todos los derechos reservados.
