/**
 * Nama cookie sesi Auth.js. Eksplisit (bukan default) agar middleware Edge
 * dan server Node memakai nama yang sama persis — tanpa tebakan prefix aman.
 * File ini SENGAJA tanpa import Node agar aman di-import dari middleware Edge.
 */
export const SESSION_COOKIE_NAME = "hadirku.session-token";
