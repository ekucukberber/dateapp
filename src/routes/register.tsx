import { createFileRoute } from '@tanstack/react-router';
import { SignUp } from '@clerk/tanstack-react-start';

export const Route = createFileRoute('/register')({
  component: Register,
});

function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <SignUp
        routing="hash"
        signInUrl="/login"
        afterSignUpUrl="/dashboard"
      />
    </div>
  );
}
