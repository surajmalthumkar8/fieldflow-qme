// Single source of truth for the AI agent's display name on the frontend.
// Change it here (or via NEXT_PUBLIC_PERSONA_NAME) — the backend persona name
// lives in backend/app/prompts/persona.yaml. Keep them in sync.
//
// Industry-agnostic on purpose: today a real-estate receptionist, tomorrow the
// same "Elara" brand can front sales / support / voice agents across verticals.
export const PERSONA_NAME = process.env.NEXT_PUBLIC_PERSONA_NAME || "Elara";
