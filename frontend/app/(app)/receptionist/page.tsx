import { redirect } from "next/navigation";

// The old scripted home-services demo receptionist has been retired in favour of
// the real local-LLM receptionist (Elara). Redirect any old links here.
export default function ReceptionistPage() {
  redirect("/ai-receptionist");
}
