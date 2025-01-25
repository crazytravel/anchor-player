import './icon.css';

interface NextIconProps {
  size?: number;
  color?: string;
}

function NextIcon({ size = 48, color = '#666666' }: NextIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={`${size}px`}
      viewBox="0 -960 960 960"
      width={`${size}px`}
      fill={color}
    >
      <path d="M680-240v-480h60v480h-60Zm-460 0v-480l346 240-346 240Zm60-240Zm0 125 181-125-181-125v250Z" />
    </svg>
  );
}

export default NextIcon;
