export type RolAsignable = "ADMINISTRADOR" | "EMPLEADO";

export type Usuario = {
  id: number;
  email: string;
  nombre: string;
  rol: "SYSADMIN" | RolAsignable;
  activo: boolean;
  creadoPorId: number | null;
  createdAt: string;
};
