import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@clerk/tanstack-react-start';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState, useRef, useEffect } from 'react';
import { Loader2, Upload, User } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useUser();
  const profile = useQuery(api.profile.get);
  const updateProfile = useMutation(api.profile.update);
  const generateUploadUrl = useMutation(api.profile.generateUploadUrl);

  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [genderPreference, setGenderPreference] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setAge(profile.age?.toString() || '');
      setGender(profile.gender || '');
      setGenderPreference(profile.genderPreference || '');
      setBio(profile.bio || '');
      if (profile.photos && profile.photos.length > 0) {
        setPreviewUrl(profile.photos[0]);
      }
    }
  }, [profile]);

  // Redirect to login if not authenticated
  if (isLoaded && !isSignedIn) {
    navigate({ to: '/login' });
    return null;
  }

  // Loading state
  if (!isLoaded || profile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      let photoStorageId = undefined;

      // Upload photo if selected
      if (selectedFile) {
        setIsUploading(true);
        const uploadUrl = await generateUploadUrl();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': selectedFile.type },
          body: selectedFile,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload photo');
        }

        const { storageId } = await uploadResponse.json();
        photoStorageId = storageId;
        setIsUploading(false);
      }

      // Update profile
      await updateProfile({
        age: age ? parseInt(age) : undefined,
        gender: gender as any,
        genderPreference: genderPreference as any,
        bio: bio || undefined,
        photoStorageId,
      });

      toast.success('Profile updated successfully!');
      navigate({ to: '/dashboard' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const isValid = age && parseInt(age) >= 18 && gender && genderPreference;

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Edit Profile</h1>
          <p className="text-muted-foreground">
            Tell us about yourself to find better matches
          </p>
        </div>

        <div className="space-y-8">
          {/* Profile Photo */}
          <div className="space-y-4">
            <label className="text-lg font-bold">Profile Photo</label>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-gray-100 flex items-center justify-center">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Photo
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Max 5MB. JPG, PNG, or GIF.
                </p>
              </div>
            </div>
          </div>

          {/* Age */}
          <div className="space-y-2">
            <label className="text-lg font-bold">Age *</label>
            <Input
              type="number"
              placeholder="Enter your age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min="18"
              max="100"
            />
            {age && parseInt(age) < 18 && (
              <p className="text-sm text-destructive">
                You must be at least 18 years old
              </p>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label className="text-lg font-bold">I am *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGender(option.value)}
                  className={`py-4 px-6 border-2 border-black font-bold transition-all ${
                    gender === option.value
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Preference */}
          <div className="space-y-2">
            <label className="text-lg font-bold">Interested in *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'male', label: 'Men' },
                { value: 'female', label: 'Women' },
                { value: 'both', label: 'Everyone' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGenderPreference(option.value)}
                  className={`py-4 px-6 border-2 border-black font-bold transition-all ${
                    genderPreference === option.value
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-lg font-bold">About Me</label>
              <span className="text-sm text-muted-foreground">
                {bio.length}/500
              </span>
            </div>
            <textarea
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={6}
              className="w-full px-4 py-3 border-2 border-black focus:outline-none focus:ring-4 focus:ring-black/20 font-mono resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={!isValid || isSaving}
              className="flex-1 py-6 text-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Profile'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/dashboard' })}
              className="px-8 py-6 text-lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
