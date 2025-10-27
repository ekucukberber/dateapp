import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useUser, useClerk } from '@clerk/tanstack-react-start';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [isJoining, setIsJoining] = useState(false);

  // Convex hooks - reactive queries automatically update
  const queueStatus = useQuery(api.queue.status);
  const joinQueue = useMutation(api.queue.join);
  const leaveQueue = useMutation(api.queue.leave);

  // Handler functions
  const handleCancelSearch = async () => {
    try {
      await leaveQueue({});
    } catch (error) {
      console.error('Error leaving queue:', error);
    }
  };

  const handleSignOut = async () => {
    // Leave queue if searching
    if (queueStatus?.inQueue) {
      await handleCancelSearch();
    }
    await signOut();
    navigate({ to: '/' });
  };

  // Redirect to login if not authenticated
  if (isLoaded && !isSignedIn) {
    navigate({ to: '/login' });
    return null;
  }

  // If user doesn't exist in Convex, show error (user was deleted or webhook hasn't fired yet)
  if (queueStatus && !queueStatus.userExists) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 px-4">
        <h1 className="text-2xl font-bold">Account Not Found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Your account is being set up. Please wait a moment and refresh the page.
          If this persists, try signing out and signing back in.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Automatically redirect when matched (reactive!)
  useEffect(() => {
    if (queueStatus?.matched && queueStatus.chatSessionId) {
      navigate({
        to: '/chat/$chatId',
        params: { chatId: queueStatus.chatSessionId },
      });
    }
  }, [queueStatus, navigate]);

  const handleFindMatch = async () => {
    setIsJoining(true);
    try {
      const result = await joinQueue({});

      if (result.matched && result.chatSessionId) {
        // Immediately matched
        navigate({
          to: '/chat/$chatId',
          params: { chatId: result.chatSessionId },
        });
      }
      // If not matched, user is added to queue and queueStatus query will update automatically
    } catch (error: any) {
      console.error('Error joining queue:', error);
      // Show user-friendly error message
      alert(error?.message || 'Failed to join queue. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  if (!isLoaded || queueStatus === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" onClick={handleSignOut} className="border-none shadow-none">
          Sign out
        </Button>
      </div>

      <div className="text-center space-y-12">
        {!queueStatus.inQueue && !queueStatus.matched && (
          <>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold">Ready, {user?.username || user?.firstName}?</h1>
              <p className="text-lg text-muted-foreground">
                Click below to find someone new
              </p>
            </div>

            <Button
              size="lg"
              className="px-16 py-8 text-2xl"
              onClick={handleFindMatch}
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Joining...
                </>
              ) : (
                'Find Match'
              )}
            </Button>
          </>
        )}

        {queueStatus.inQueue && !queueStatus.matched && (
          <>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold">Searching...</h1>
              <p className="text-lg text-muted-foreground">
                Looking for someone to chat with
              </p>
            </div>

            <div className="flex flex-col items-center gap-6">
              <Loader2 className="h-16 w-16 animate-spin" />
              <Button
                variant="outline"
                size="lg"
                onClick={handleCancelSearch}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
