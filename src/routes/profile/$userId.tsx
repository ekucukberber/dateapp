import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/tanstack-react-start';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Loader2, ArrowLeft, User, MessageCircle } from 'lucide-react';

export const Route = createFileRoute('/profile/$userId')({
  component: ProfileViewPage,
});

function ProfileViewPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useUser();

  // We'll need to create a query to fetch user profiles
  // For now, let's show a coming soon message

  // Redirect to login if not authenticated
  if (isLoaded && !isSignedIn) {
    navigate({ to: '/login' });
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black px-6 py-4 bg-white">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/matches">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Matches
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center py-16">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Profile View</h2>
          <p className="text-muted-foreground mb-6">
            View matched user profiles (Coming Soon)
          </p>
          <p className="text-sm text-muted-foreground">
            For now, you can see profiles in the chat when you match!
          </p>
        </div>
      </div>
    </div>
  );
}
