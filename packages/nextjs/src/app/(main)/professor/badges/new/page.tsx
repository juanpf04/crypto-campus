import { redirect } from "next/navigation";

// Ruta antigua — para crear una tarea, el profesor debe entrar primero a
// una asignatura concreta desde el sidebar.
export default function DeprecatedNewAssignmentRedirect() {
  redirect("/professor");
}
