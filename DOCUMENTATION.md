# DOCUMENTATION.md

## 1. Objetivo del proyecto

Este sistema fue diseñado para simular un entorno empresarial académico de manera práctica, visual y controlada.  
No busca replicar absolutamente todos los procesos reales de una empresa, sino ofrecer una base sólida para aprendizaje y toma de decisiones.

## 2. Alcance funcional de v1.0.0

La versión estable actual cubre:

- login y sesión
- invitaciones de estudiantes
- RBAC básico
- gestión de usuarios
- creación/edición/disolución de equipos
- gestión de empresas simuladas
- operación mensual
- dashboards diferenciados
- chat básico en tiempo real

## 3. Arquitectura general

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS

### Backend gestionado
- Firebase Authentication
- Cloud Firestore

## 4. Modelo conceptual del sistema

### Usuarios
Cada usuario tiene:
- UID
- nombre
- apellido
- correo
- rol
- estado
- teamId opcional
- puesto opcional en estudiantes

### Equipos
Cada equipo tiene:
- nombre
- memberIds
- memberNames
- createdBy
- timestamps

### Empresas
Cada empresa tiene:
- teamId
- teamName
- businessName
- tradeName
- legalId
- industry
- status
- datos formales/operativos

### Operaciones mensuales
Cada operación mensual tiene:
- companyId
- teamId
- periodYear
- periodMonth
- periodLabel
- openingCash
- ingresos
- gastos
- planilla
- impuestos
- totalIncome
- totalExpenses
- closingCash
- netResult
- status

### Chats
Cada equipo genera:
- `team_internal_<teamId>`
- `team_professor_<teamId>`

Y cada chat tiene:
- tipo
- título
- subtítulo
- participantIds
- metadatos de último mensaje
- subcolección `messages`

## 5. Roles y permisos

### Admin
- acceso total
- puede ver/editar todo
- puede gestionar usuarios, equipos, empresas, operaciones y chats

### Professor
- acceso académico/operativo
- puede gestionar estudiantes, equipos, empresas y operaciones permitidas
- puede participar en chats de profesor-equipo

### Student
- acceso restringido a su propio contexto
- lee su empresa/equipo/operación
- participa en chats autorizados
- no puede escalar permisos

## 6. Flujo recomendado de uso

1. crear usuarios o invitar estudiantes
2. asignar rol y puesto
3. crear equipos
4. crear empresa para un equipo
5. abrir operación mensual
6. usar dashboard y chat durante la práctica
7. revisar resultados

## 7. Dashboard de estudiante

El dashboard del estudiante se personaliza según:
- puesto
- equipo asignado
- empresa asignada
- último período operativo

Debe mostrar:
- estado actual
- métricas útiles
- alertas
- prioridades del puesto
- semáforo empresarial

## 8. Chat en tiempo real

### v1 actual
- chat interno de equipo
- chat equipo ↔ profesor
- mensajes de texto
- borrado lógico
- sonido simple de notificación
- visible en toda página que use `AppShell`

### Reglas de diseño
- simple
- rápido
- sin ruido
- sin audios ni videos
- escalable para imágenes después

## 9. Firebase y configuración

### Si no usas Cloud Functions
Debes eliminar del `firebase.json` la sección `functions`.

Si tu archivo actualmente solo tiene eso, puede quedar así:

```json
{}
```

Si más adelante usas `hosting`, `firestore`, `storage` u otra configuración, mantén únicamente esas secciones.

## 10. Recomendación de repositorio

Este proyecto debería mantenerse como **privado**.

Razón:
- no es open source
- contiene lógica propietaria
- solo personal autorizado debe tener acceso operativo

## 11. Versionado recomendado

Versión estable inicial:
- `v1.0.0`

Comandos sugeridos:

```bash
git add .
git commit -m "Release stable v1.0.0"
git tag -a v1.0.0 -m "Stable v1.0.0"
git push origin main
git push origin v1.0.0
```

## 12. Checklist antes de pruebas con estudiantes

- validar login de admin
- validar login de profesor
- validar login de estudiante
- validar dashboard del estudiante
- validar empresa asignada
- validar operación mensual
- validar creación/disolución de equipos
- validar chat de equipo
- validar responsive básico

## 13. Pendientes sugeridos post-v1

- chat directo estudiante ↔ profesor
- imágenes en chat
- unread counters más finos
- módulo configurable por docente
- mejoras de onboarding
- mejoras de reportes/exportaciones

## 14. Observación legal y operativa

Este proyecto no debe publicarse como open source si el objetivo es restringir su uso.  
La forma correcta de controlarlo es:

1. repositorio privado
2. colaboradores autorizados
3. licencia propietaria
4. control interno de distribución
