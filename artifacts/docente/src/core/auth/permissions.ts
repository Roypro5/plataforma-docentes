import matrix from "./permission-matrix.json";

// Versioned role→permission matrix. The SQL function app_private.permission_matrix()
// mirrors it and the SQL/RLS harness fails if they diverge.
export type RoleCode = keyof typeof matrix;
export type Permission = (typeof matrix)[RoleCode][number];

export const roleCodes = Object.keys(matrix) as RoleCode[];

export function permissionsFor(roles: readonly string[]): Set<Permission> {
  const granted = new Set<Permission>();
  for (const role of roles) {
    if (role in matrix) for (const p of matrix[role as RoleCode]) granted.add(p as Permission);
  }
  return granted;
}

export function can(roles: readonly string[], permission: Permission) {
  return permissionsFor(roles).has(permission);
}
