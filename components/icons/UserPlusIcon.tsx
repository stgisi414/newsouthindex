import React from 'react';

const UserPlusIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M6.25 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM3.125 19.125a2.25 2.25 0 012.25-2.25h13.25a2.25 2.25 0 012.25 2.25" />
    <path d="M19 12.75a.75.75 0 000-1.5h-2.25V9a.75.75 0 00-1.5 0v2.25H13a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H19z" />
  </svg>
);

export default UserPlusIcon;
