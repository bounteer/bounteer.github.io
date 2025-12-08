import { useState, useEffect, useRef } from 'react';
import { EXTERNAL } from '@/constant';

// The component receives the URL and title as properties (props)
interface Props {
  postUrl: string;
  title: string;
}

export default function ShareButton({ postUrl, title }: Props) {
  // State: a boolean to track if the menu is open or closed.
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // This function copies the link to the clipboard.
  const copyLink = () => {
    navigator.clipboard
      .writeText(postUrl)
      .then(() => alert('Link copied to clipboard!'))
      .catch(() => alert('Failed to copy link.'));
    setIsOpen(false); // Close menu after copying
  };

  // This is the elegant way to handle "click outside to close".
  // It adds an event listener when the component mounts and cleans it
  // up automatically when you navigate away. No memory leaks.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    // Add the event listener when the menu is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    // Cleanup function: remove the listener when the component is unmounted
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]); // Re-run this effect only when `isOpen` changes

  return (
    <div className="relative inline-block mt-8" ref={wrapperRef}>
      {/* Main Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)} // Toggle the state on click
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
      >
        Share
      </button>

      {/* Share Menu: Renders only if `isOpen` is true */}
      {isOpen && (
        <div className="absolute bottom-full z-10 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col">
          <button
            onClick={copyLink}
            className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
          >
            🔗 Copy link
          </button>
          <a
            href={`${EXTERNAL.twitter_intent_url}?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 text-sm hover:bg-gray-100"
          >
            🐦 Share on X
          </a>
          <a
            href={`${EXTERNAL.facebook_share_url}?u=${encodeURIComponent(postUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 text-sm hover:bg-gray-100"
          >
            📘 Share on Facebook
          </a>
          <a
            href={`${EXTERNAL.linkedin_share_url}?mini=true&url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 text-sm hover:bg-gray-100"
          >
            💼 Share on LinkedIn
          </a>
        </div>
      )}
    </div>
  );
}