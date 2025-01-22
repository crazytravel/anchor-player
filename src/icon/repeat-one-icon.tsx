import "./icon.css";

interface RepeatOneIconProps {
    size?: number;
    color?: string;
    onClick?: () => void;
}

function RepeatOneIcon({size = 24, color = "#666666", onClick}: RepeatOneIconProps) {
    return (
        <svg
            onClick={onClick}
            xmlns="http://www.w3.org/2000/svg" height={`${size}px`} viewBox="0 -960 960 960" width={`${size}px`}
            fill={color}>
            <path
                d="M460-360v-180h-60v-60h120v240h-60ZM280-80 120-240l160-160 56 58-62 62h406v-160h80v240H274l62 62-56 58Zm-80-440v-240h486l-62-62 56-58 160 160-160 160-56-58 62-62H280v160h-80Z"/>
        </svg>
    )
}

export default RepeatOneIcon;