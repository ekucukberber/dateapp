import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useUser, useClerk } from '@clerk/tanstack-react-start';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState, useEffect, Fragment, useRef } from 'react';
import { Loader2, User, Heart, Bell } from 'lucide-react';
import { toast } from 'sonner';

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
  const pendingRequests = useQuery(api.chatRequests.listPending);
  const matches = useQuery(api.matches.list);

  // Track previous matches state to detect when a pending request becomes active
  const prevMatchesRef = useRef(matches);

  // Handler functions
  const handleCancelSearch = async () => {
    try {
      await leaveQueue({});
    } catch (error) {
      console.error('Error leaving queue:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      // Leave queue if searching
      if (queueStatus?.inQueue) {
        await handleCancelSearch();
      }
      // Sign out with explicit redirect - this clears the Clerk session
      await signOut({ redirectUrl: window.location.origin + '/login' });
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out. Please try again.');
    }
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

  // Auto-redirect when a new chat session is created (request accepted)
  useEffect(() => {
    if (!matches || !prevMatchesRef.current) {
      prevMatchesRef.current = matches;
      return;
    }

    // Check if any match has a new active chat session
    matches.forEach((match) => {
      const prevMatch = prevMatchesRef.current?.find((m) => m._id === match._id);

      if (
        prevMatch &&
        !prevMatch.hasActiveChat &&
        match.hasActiveChat &&
        match.chatSessionId
      ) {
        // New chat session created! Redirect
        toast.success('Chat is ready!');
        navigate({
          to: '/chat/$chatId',
          params: { chatId: match.chatSessionId },
        });
      }
    });

    prevMatchesRef.current = matches;
  }, [matches, navigate]);

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
      toast.error(error?.message || 'Failed to join queue. Please try again.');
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
      <div className="absolute top-4 right-4 flex gap-2">
        <Link to="/profile">
          <Button variant="outline" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </Button>
        </Link>
        <Link to="/matches">
          <Button variant="outline" size="sm" className="gap-2">
            <Heart className="h-4 w-4" />
            Matches
          </Button>
        </Link>
        <Link to="/notifications">
          <Button variant="outline" size="sm" className="gap-2 relative">
            <Bell className="h-4 w-4" />
            Notifications
            {pendingRequests && pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {pendingRequests.length}
              </span>
            )}
          </Button>
        </Link>
        <Button variant="ghost" onClick={handleSignOut} className="border-none shadow-none">
          Sign out
        </Button>
      </div>

      <div className="text-center space-y-12">
        {!queueStatus.inQueue && !queueStatus.matched && (
          <Fragment key="idle">
            <div key="idle-text" className="space-y-4">
              <h1 className="text-5xl font-bold">Ready, {user?.username || user?.firstName}?</h1>
              <p className="text-lg text-muted-foreground">
                Click below to find someone new
              </p>
            </div>

            <Button
              key="idle-button"
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
          </Fragment>
        )}

        {queueStatus.inQueue && !queueStatus.matched && (
          <Fragment key="searching">
            <div key="searching-text" className="space-y-4">
              <h1 className="text-5xl font-bold">Searching...</h1>
              <p className="text-lg text-muted-foreground">
                Looking for someone to chat with
              </p>
            </div>

            <div key="searching-actions" className="flex flex-col items-center gap-6">
              <Loader2 className="h-16 w-16 animate-spin" />
              <Button
                variant="outline"
                size="lg"
                onClick={handleCancelSearch}
              >
                Cancel
              </Button>
            </div>
          </Fragment>
        )}
      </div>
    </div>
  );
}
