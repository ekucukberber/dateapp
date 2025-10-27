import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/tanstack-react-start';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Loader2, Bell, User, ArrowLeft, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useUser();
  const requests = useQuery(api.chatRequests.listPending);
  const acceptRequest = useMutation(api.chatRequests.accept);
  const declineRequest = useMutation(api.chatRequests.decline);

  // Redirect to login if not authenticated
  if (isLoaded && !isSignedIn) {
    navigate({ to: '/login' });
    return null;
  }

  // Loading state
  if (!isLoaded || requests === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  const handleAccept = async (requestId: Id<"chatRequests">) => {
    try {
      const result = await acceptRequest({ requestId });
      toast.success('Chat request accepted!');
      navigate({
        to: '/chat/$chatId',
        params: { chatId: result.chatSessionId },
      });
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast.error(error?.message || 'Failed to accept request');
    }
  };

  const handleDecline = async (requestId: Id<"chatRequests">) => {
    try {
      await declineRequest({ requestId });
      toast.success('Chat request declined');
    } catch (error: any) {
      console.error('Error declining request:', error);
      toast.error(error?.message || 'Failed to decline request');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black px-6 py-4 bg-white">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {requests.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No new notifications</h2>
            <p className="text-muted-foreground mb-6">
              Chat requests from your matches will appear here
            </p>
            <Link to="/dashboard">
              <Button size="lg">Find Match</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="border-2 border-black shadow-3d-sm p-6 bg-white"
              >
                <div className="flex items-start gap-4">
                  {/* Profile Photo */}
                  <div className="w-16 h-16 rounded-full border-2 border-black overflow-hidden bg-gray-100 flex-shrink-0">
                    {request.fromUser?.photos &&
                    request.fromUser.photos.length > 0 ? (
                      <img
                        src={request.fromUser.photos[0]}
                        alt={request.fromUser.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold mb-1">
                      {request.fromUser?.name || 'Anonymous'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {request.fromUser?.age
                        ? `${request.fromUser.age} years old`
                        : 'Age not set'}
                      {request.fromUser?.gender &&
                        ` • ${
                          request.fromUser.gender.charAt(0).toUpperCase() +
                          request.fromUser.gender.slice(1)
                        }`}
                    </p>
                    <p className="text-sm mb-2">
                      Wants to chat with you again!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                  <Button
                    onClick={() => handleAccept(request._id)}
                    className="flex-1 gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleDecline(request._id)}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <X className="h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
