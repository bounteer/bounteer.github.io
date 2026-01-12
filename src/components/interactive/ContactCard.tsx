export function ContactCard() {
  return (
    <div className="mt-4 px-3 py-2 text-sm text-gray-500 text-center italic">
      Contact us at{" "}
      <a
        href="mailto:sho@bounteer.com"
        className="text-blue-600 hover:underline"
      >
        sho@bounteer.com
      </a>{" "}
      or{" "}
      <a
        href="https://t.me/kanekoshoyu"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        @kanekoshoyu
      </a>
    </div>
  );
}
