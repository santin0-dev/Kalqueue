import { Suspense } from "react";
import LoginPage from "./login-client";

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <LoginPage />
    </Suspense>
  );
}
