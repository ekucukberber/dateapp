import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@clerk/tanstack-react-start';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useState, useEffect, useRef } from 'react';
import { Send, Clock, LogOut, Heart, X, Loader2 } from 'lucide-react';

export const Route = createFileRoute('/chat/$chatId')({
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded, user } = useUser();
  const [newMessage, setNewMessage] = useState('');
  const [showDecisionUI, setShowDecisionUI] = useState(false);
  const [myDecision, setMyDecision] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerExpiredRef = useRef(false);

  // Convex queries - automatically reactive!
  const chatData = useQuery(api.messages.list, {
    chatSessionId: chatId as Id<"chatSessions">,
  });

  const sendMessage = useMutation(api.messages.send);
  const leaveChat = useMutation(api.messages.leaveChat);
  const makeDecision = useMutation(api.decisions.makeDecision);

  // Redirect to login if not authenticated
  if (isLoaded && !isSignedIn) {
    navigate({ to: '/login' });
    return null;
  }

  // Track if chat has ended to show proper UI
  const [chatEnded, setChatEnded] = useState(false);

  // Handle chat ended
  useEffect(() => {
    if (chatData?.chatSession?.status === 'ended' && !chatEnded) {
      setChatEnded(true);
    }
  }, [chatData?.chatSession?.status, chatEnded]);

  // Handle decision UI
  useEffect(() => {
    if (chatData?.chatSession?.status === 'waiting_reveal' && !showDecisionUI) {
      setShowDecisionUI(true);
    }
  }, [chatData?.chatSession?.status, showDecisionUI]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatData?.messages]);

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!chatData?.chatSession?.speedDatingEndsAt) return null;
    const now = Date.now();
    const endTime = chatData.chatSession.speedDatingEndsAt;
    const diff = endTime - now;

    if (diff <= 0) return '00:00';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());

  // Update timer every second and check for expiration
  // Optimized to only update state when value changes (prevents unnecessary re-renders)
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const remaining = getTimeRemaining();

      // Only update state if value actually changed (prevents unnecessary re-renders)
      setTimeRemaining((prev) => {
        if (prev === remaining) return prev;
        return remaining;
      });

      // Check if timer just expired (only in speed_dating phase)
      if (
        remaining === '00:00' &&
        chatData?.chatSession?.phase === 'speed_dating' &&
        chatData?.chatSession?.status === 'active' &&
        !timerExpiredRef.current
      ) {
        timerExpiredRef.current = true;
        setShowDecisionUI(true);
        clearInterval(timerInterval); // Stop timer after expiration
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [chatData?.chatSession?.speedDatingEndsAt, chatData?.chatSession?.phase, chatData?.chatSession?.status]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage({
        chatSessionId: chatId as Id<"chatSessions">,
        content: newMessage,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleLeaveChat = async () => {
    try {
      await leaveChat({ chatSessionId: chatId as Id<"chatSessions"> });
      navigate({ to: '/dashboard' });
    } catch (error) {
      console.error('Error leaving chat:', error);
    }
  };

  const handleDecision = async (wantsToContinue: boolean) => {
    if (myDecision !== null) return;

    try {
      const result = await makeDecision({
        chatSessionId: chatId as Id<"chatSessions">,
        wantsToContinue,
      });

      setMyDecision(wantsToContinue);

      // If both decided, handle the outcome
      if (result.bothDecided) {
        if (result.matchCreated) {
          alert("It's a match! You can now see each other's profiles");
          setShowDecisionUI(false);
          // Convex will automatically update chatData with new phase
        } else {
          // Chat ended - the overlay will show automatically via chatEnded state
          setShowDecisionUI(false);
          // Note: setChatEnded will be triggered by the useEffect watching chatData.chatSession.status
        }
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
      alert('Failed to submit decision. Please try again.');
    }
  };

  // Loading state
  if (!isLoaded || chatData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state (query failed or returned null)
  if (chatData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold">Unable to Load Chat</h2>
          <p className="text-muted-foreground">
            This chat may not exist, may have ended, or you don't have permission to view it.
          </p>
          <Button
            size="lg"
            onClick={() => navigate({ to: '/dashboard' })}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { messages, chatSession, otherUser, currentUserId } = chatData;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b-2 border-black px-6 py-4 flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            {chatSession.phase === 'extended' ? 'Matched Chat' : 'Speed Dating'}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveChat}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
        {chatSession.phase === 'speed_dating' && (
          <div className="flex items-center gap-2 text-lg font-mono">
            <Clock className="h-5 w-5" />
            <span className="font-bold">{timeRemaining}</span>
          </div>
        )}
      </div>

      {/* Chat Ended Overlay */}
      {chatEnded && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-4 border-black shadow-3d-lg p-8 max-w-md w-full mx-4">
            <div className="text-center space-y-6">
              <div className="text-6xl">👋</div>
              <h2 className="text-3xl font-bold">Chat Has Ended</h2>
              <p className="text-lg text-muted-foreground">
                {myDecision === false
                  ? "You chose not to continue this chat."
                  : myDecision === true
                  ? "The other person chose not to continue."
                  : "This chat has ended."}
              </p>
              <p className="text-sm text-muted-foreground">
                All messages have been deleted for privacy.
              </p>
              <Button
                size="lg"
                onClick={() => navigate({ to: '/dashboard' })}
                className="w-full py-6 text-lg"
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Decision UI Overlay */}
      {showDecisionUI && !chatEnded && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-4 border-black shadow-3d-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-3xl font-bold text-center mb-6">
              Time's Up!
            </h2>
            <p className="text-center text-lg mb-8">
              Do you want to continue chatting and see this person's profile?
            </p>

            {myDecision === null ? (
              <div className="flex gap-4">
                <Button
                  onClick={() => handleDecision(false)}
                  variant="outline"
                  className="flex-1 gap-2 py-6 text-lg"
                >
                  <X className="h-6 w-6" />
                  No Thanks
                </Button>
                <Button
                  onClick={() => handleDecision(true)}
                  className="flex-1 gap-2 py-6 text-lg bg-black text-white hover:bg-black/90"
                >
                  <Heart className="h-6 w-6" />
                  Yes, Continue
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xl font-bold mb-2">
                  {myDecision ? 'You said Yes!' : 'You said No'}
                </p>
                <p className="text-muted-foreground">
                  Waiting for the other person to decide...
                </p>
                <div className="mt-6">
                  <div className="animate-pulse text-4xl">⏳</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Card (Extended Phase Only) */}
      {chatSession.phase === 'extended' && otherUser && (
        <div className="border-b-2 border-black px-6 py-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 p-4 border-2 border-black shadow-3d">
              {otherUser.image && (
                <img
                  src={otherUser.image}
                  alt={otherUser.name}
                  className="w-16 h-16 rounded-full border-2 border-black"
                />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold">{otherUser.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {otherUser.age && `${otherUser.age} years old`}
                  {otherUser.age && otherUser.gender && ' • '}
                  {otherUser.gender}
                </p>
                {otherUser.bio && (
                  <p className="mt-2 text-sm">{otherUser.bio}</p>
                )}
              </div>
              <div className="text-4xl">❤️</div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4 bg-white">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground">
            <p>No messages yet. Say hi!</p>
          </div>
        )}
        {messages.map((message) => {
          const isMyMessage = message.senderId === currentUserId;
          return (
            <div
              key={message._id}
              className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-3 rounded-lg shadow-3d-sm border-2 border-black ${
                  isMyMessage
                    ? 'bg-black text-white'
                    : 'bg-white text-black'
                }`}
              >
                <p className="break-words">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t-2 border-black px-6 py-4 bg-white"
      >
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder={chatEnded ? "Chat has ended" : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={chatEnded}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || chatEnded}
            className="px-6"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
