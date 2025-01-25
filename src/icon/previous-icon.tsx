import './icon.css';

interface PreviousIconProps {
  size?: number;
  color?: string;
}

function PreviousIcon({ size = 48, color = '#666666' }: PreviousIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={`${size}px`}
      viewBox="0 -960 960 960"
      width={`${size}px`}
      fill={color}
    >
      <path d="M220-240v-480h60v480h-60Zm520 0L394-480l346-240v480Zm-60-240Zm0 125v-250L499-480l181 125Z" />
    </svg>
  );
}

export default PreviousIcon;
