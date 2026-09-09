-- SeedSeguimiento5sApplication
-- "updated_at" se fija explícitamente en las tres tablas cuyo DEFAULT quitó la migración
-- anterior (`schema.prisma` sólo declara `@updatedAt`, poblado por Prisma Client, no por la base).
INSERT INTO "applications" (
    "id", "key", "name", "description", "launch_path", "display_order", "updated_at"
) VALUES (
    '3c4f3754-ce91-4934-9b24-51f246c27136',
    'seguimiento-5s',
    'Seguimiento 5S',
    'Seguimiento diario de indicadores 5S por persona, con historial y dashboard de cumplimiento.',
    '/apps/seguimiento-5s',
    3,
    CURRENT_TIMESTAMP
);

INSERT INTO "application_permissions" (
    "id", "application_id", "key", "name", "description", "updated_at"
) VALUES
    (
        'c24b34ab-d1e5-49fd-9b43-ce26b4b64bae',
        '3c4f3754-ce91-4934-9b24-51f246c27136',
        'manage-indicators',
        'Administrar indicadores',
        'Crear, editar y activar o desactivar indicadores 5S.',
        CURRENT_TIMESTAMP
    ),
    (
        '55ff1abc-b3b8-4202-bc52-df429fab18db',
        '3c4f3754-ce91-4934-9b24-51f246c27136',
        'manage-entries',
        'Registrar seguimiento diario',
        'Cargar y editar el checklist diario de todo el equipo.',
        CURRENT_TIMESTAMP
    ),
    (
        '852ddae3-dc09-40d6-82a8-b2e5690d53a0',
        '3c4f3754-ce91-4934-9b24-51f246c27136',
        'manage-participants',
        'Administrar participantes',
        'Asignar el perfil de líder o miembro a los empleados con acceso a la aplicación.',
        CURRENT_TIMESTAMP
    );

INSERT INTO "access_profiles" (
    "id", "key", "name", "description", "scope", "application_id", "updated_at"
) VALUES
    (
        'a78171a7-6be6-46c1-8a26-a167786fa354',
        'lider-5s',
        'Líder 5S',
        'Administra indicadores, carga el seguimiento diario del equipo y asigna roles.',
        'APPLICATION',
        '3c4f3754-ce91-4934-9b24-51f246c27136',
        CURRENT_TIMESTAMP
    ),
    (
        '8ee25c46-7b75-4213-8dcb-67e26c4eb719',
        'miembro-5s',
        'Miembro 5S',
        'Consulta el historial y el dashboard de seguimiento 5S.',
        'APPLICATION',
        '3c4f3754-ce91-4934-9b24-51f246c27136',
        CURRENT_TIMESTAMP
    );

INSERT INTO "access_profile_permissions" ("id", "profile_id", "permission_id") VALUES
    (
        '1f716732-3b6b-4a18-96b8-331340d56760',
        'a78171a7-6be6-46c1-8a26-a167786fa354',
        'c24b34ab-d1e5-49fd-9b43-ce26b4b64bae'
    ),
    (
        '4d52292b-65fa-4b6d-97e8-3e47260cf76b',
        'a78171a7-6be6-46c1-8a26-a167786fa354',
        '55ff1abc-b3b8-4202-bc52-df429fab18db'
    ),
    (
        'ef1f808c-f170-4c1a-98c5-cd1ac07fb927',
        'a78171a7-6be6-46c1-8a26-a167786fa354',
        '852ddae3-dc09-40d6-82a8-b2e5690d53a0'
    );
