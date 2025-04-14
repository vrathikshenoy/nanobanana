'use client'; // This directive is needed for client-side interactivity (hooks, event handlers)

import { useState, ChangeEvent, FormEvent, useRef } from 'react';
import { Github, Twitter, Linkedin } from 'lucide-react'; // Assuming lucide-react for icons

export default function TryOnPage() {
  const [userImage, setUserImage] = useState<File | null>(null);
  const [clothingImage, setClothingImage] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
  const [clothingImagePreview, setClothingImagePreview] = useState<string | null>(null);
  const [resultImageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for file inputs to allow resetting
  const userFileInputRef = useRef<HTMLInputElement>(null);
  const clothingFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    setImage: (file: File | null) => void,
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage(file);
      // Generate preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null); // Clear previous errors on new file selection
    } else {
      setImage(null);
      setPreview(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userImage || !clothingImage) {
      setError('Please upload both your photo and a clothing item image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImageUrl(null); // Clear previous result

    const formData = new FormData();
    formData.append('userImage', userImage);
    formData.append('clothingImage', clothingImage);
    // No prompt needed here as the backend constructs it

    try {
      const response = await fetch('/api/tryon', {
        method: 'POST',
        body: formData,
        // No 'Content-Type' header needed, browser sets it correctly for FormData
      });

      const result = await response.json();

      // Log the entire result received by the frontend
      console.log("Frontend received result:", result);

      if (!response.ok) {
        // Use error message from API response if available
        throw new Error(result.error || `API Error: ${response.statusText}`);
      }

      console.log(response)

      // Use the correct field name from the API response ('image')
      if (result.image) {
        setImageUrl(result.image);
        console.log(resultImageUrl)

      } else {
        // Log the description or other info if image is missing but response is ok
        console.log("API response description:", result.description);
        console.log("API response:", result);
        throw new Error('API did not return a generated image URL.');
      }

    } catch (err: unknown) {
      console.error('Submission Error:', err);
      // Type check the error before accessing properties
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during image generation.';
      setError(errorMessage);
      setImageUrl(null); // Ensure no broken image is shown
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
      setUserImage(null);
      setClothingImage(null);
      setUserImagePreview(null);
      setClothingImagePreview(null);
      setImageUrl(null);
      setError(null);
      setIsLoading(false);
       // Reset file input fields
      if (userFileInputRef.current) userFileInputRef.current.value = '';
      if (clothingFileInputRef.current) clothingFileInputRef.current.value = '';
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 transition-colors duration-200">
      {/* Title - Removed dark mode classes */}
      <h1 className="text-4xl font-bold my-6 text-center text-gray-800">
        AI Virtual Try-On
      </h1>

      {/* Social Links - Removed dark mode classes */}
      <div className="flex items-center justify-center space-x-5 mb-8">
        <a href="#" target="_blank" rel="noopener noreferrer" title="GitHub" className="text-gray-600 hover:text-gray-900 transition-colors">
          <Github size={24} />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" title="Twitter" className="text-gray-600 hover:text-gray-900 transition-colors">
          <Twitter size={24} />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" title="LinkedIn" className="text-gray-600 hover:text-gray-900 transition-colors">
          <Linkedin size={24} />
        </a>
      </div>

      {/* Main content card */}
      <main className="flex flex-grow flex-col items-center px-4 w-full">
        {/* Card styling - Removed dark mode classes */}
        <div className="w-full max-w-4xl bg-white p-6 md:p-8 rounded-lg shadow-md transition-colors duration-200">

          <p className="text-center text-gray-600 mb-6">
              Upload your photo and an image of a clothing item to see a preview!
              <br />
              <small className="text-sm text-gray-500">(Note: AI generation quality may vary. Best results with clear, front-facing photos.)</small>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Image Upload */}
              <div className="flex flex-col items-center space-y-3">
                <label htmlFor="userImage" className="block text-base font-medium text-gray-700">
                  1. Upload Your Photo
                </label>
                {/* Input styling - Removed dark mode classes */}
                <input
                  id="userImage"
                  name="userImage"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleFileChange(e, setUserImage, setUserImagePreview)}
                  ref={userFileInputRef}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 transition-colors"
                  required
                />
                {userImagePreview && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                      <img src={userImagePreview} alt="User preview" className="w-full h-auto max-h-60 object-contain bg-gray-100" />
                  </div>
                )}
              </div>

              {/* Clothing Image Upload */}
              <div className="flex flex-col items-center space-y-3">
                <label htmlFor="clothingImage" className="block text-base font-medium text-gray-700">
                  2. Upload Clothing Item
                </label>
                {/* Input styling - Removed dark mode classes */}
                <input
                  id="clothingImage"
                  name="clothingImage"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleFileChange(e, setClothingImage, setClothingImagePreview)}
                  ref={clothingFileInputRef}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-green-50 file:text-green-700
                    hover:file:bg-green-100 transition-colors"
                  required
                />
                 {clothingImagePreview && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                      <img src={clothingImagePreview} alt="Clothing preview" className="w-full h-auto max-h-60 object-contain bg-gray-100" />
                  </div>
                )}
              </div>
            </div>

            {error && (
              // Error text color - Removed dark mode classes
              <p className="text-red-600 text-sm text-center mt-4">{error}</p>
            )}

            {/* Buttons - Removed dark mode classes */}
            <div className="flex justify-center pt-4 space-x-4">
              <button
                type="submit"
                disabled={isLoading || !userImage || !clothingImage}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
              >
                {isLoading ? 'Generating...' : 'Try It On!'}
              </button>
               <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-sm hover:bg-gray-400 transition duration-150 ease-in-out"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Loading Indicator - Removed dark mode classes */}
          {isLoading && (
            <div className="mt-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
              <p className="text-indigo-600 mt-2 text-sm">Generating your virtual try-on preview...</p>
            </div>
          )}

          {/* Generated Image Display - Removed dark mode classes */}
          {resultImageUrl && !isLoading && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">Result</h2>
              <div className="flex justify-center">
                  <img
                  src={resultImageUrl}
                  alt="Virtual try-on result"
                  className="max-w-full h-auto rounded-lg shadow-md border border-gray-300 bg-gray-100"
                  style={{ maxHeight: '600px' }}
                  />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}