import { createFileRoute } from '@tanstack/react-router';
import { SignIn } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/login')({
  component: Login,
});

function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <SignIn
        routing="hash"
        signUpUrl="/register"
        afterSignInUrl="/dashboard"
      />
    </div>
  );
}
