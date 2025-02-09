
export const AlbumIcon = ({ size = 18, onClick = () => { } }) => {
  return (
    <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" className='icon' fill="currentColor">
      <path d="M400-240q50 0 85-35t35-85v-280h120v-80H460v256q-14-8-29-12t-31-4q-50 0-85 35t-35 85q0 50 35 85t85 35Zm80 160q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  );
}

export const PlayIcon = ({ size = 24 }) => {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" className='icon' fill='currentColor'>
      <path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  );
}

export const PauseIcon = ({ size = 24 }) => {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className="icon">
      <path d="M360-320h80v-320h-80v320Zm160 0h80v-320h-80v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  );
}

export const DeleteIcon = ({ size = 18, onClick = () => { } }) => {
  return (
    <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon' role="img" aria-label="[title]">
      <title>Remove from Playlist</title>
      <path d="m336-280-56-56 144-144-144-143 56-56 144 144 143-144 56 56-144 143 144 144-56 56-143-144-144 144Z" />
    </svg>
  );
}

export const InfoIcon = ({ size = 20 }) => {
  return (
    // <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon' role="img" aria-label="[title]">
    //   <title>Music Info</title>
    //   <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    // </svg>
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon' role="img" aria-label="[title]">
      <title>Music Info</title><path d="M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v400q0 66-47 113t-113 47Z" />
    </svg>
  );
}

export const NextIcon = ({ size = 45 }) => {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon'>
      <path d="M680-240v-480h60v480h-60Zm-460 0v-480l346 240-346 240Zm60-240Zm0 125 181-125-181-125v250Z" />
    </svg>
  );
}

export const PreviousIcon = ({ size = 45 }) => {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon'>
      <path d="M220-240v-480h60v480h-60Zm520 0L394-480l346-240v480Zm-60-240Zm0 125v-250L499-480l181 125Z" />
    </svg>
  );
}

export const VolumeHighIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
  </svg>
);

export const VolumeLowIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16C17.5,15.29 18.5,13.76 18.5,12Z" />
  </svg>
);

export const VolumeMuteIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
  </svg>
);

export const OpenFileIcon = ({ onClick = () => { }, size = 24 }) => (
  // <svg className="icon" onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" role="img" aria-label="[title]">
  //   <title>Open Files</title>
  //   <path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v240h-80v-200H520v-200H240v640h360v80H240Zm638 15L760-183v89h-80v-226h226v80h-90l118 118-56 57Zm-638-95v-640 640Z" />
  // </svg>
  <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className="icon" role="img" aria-label="[title]">
    <title>Playlist Add</title>
    <path d="M120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Zm520 480v-160H480v-80h160v-160h80v160h160v80H720v160h-80Z" />
  </svg>
);

export const OpenFolderIcon = ({ onClick = () => { }, size = 24 }) => (
  <svg className="icon" onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" role="img" aria-label="[title]">
    <title>Open a Directory</title>
    <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640H447l-80-80H160v480l96-320h684L837-217q-8 26-29.5 41.5T760-160H160Zm84-80h516l72-240H316l-72 240Zm0 0 72-240-72 240Zm-84-400v-80 80Z" />
  </svg>
);

export const ClearAllIcon = ({ size = 24, onClick = () => { } }) => {
  return (
    <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon' role="img" aria-label="[title]">
      <title>Clear All Playlist</title>
      <path d="m576-80-56-56 104-104-104-104 56-56 104 104 104-104 56 56-104 104 104 104-56 56-104-104L576-80ZM120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Z" />
    </svg>
  );
}

export const RandomIcon = ({ size = 20, onClick = () => { } }) => (
  <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className='icon' role="img" aria-label="[title]">
    <title>Random Playlist</title>
    <path d="M220-260q-92 0-156-64T0-480q0-92 64-156t156-64q37 0 71 13t61 37l68 62-60 54-62-56q-16-14-36-22t-42-8q-58 0-99 41t-41 99q0 58 41 99t99 41q22 0 42-8t36-22l310-280q27-24 61-37t71-13q92 0 156 64t64 156q0 92-64 156t-156 64q-37 0-71-13t-61-37l-68-62 60-54 62 56q16 14 36 22t42 8q58 0 99-41t41-99q0-58-41-99t-99-41q-22 0-42 8t-36 22L352-310q-27 24-61 37t-71 13Z" />
  </svg>
);


export const RepeatIcon = ({ size = 20, onClick = () => { } }) => (
  <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className="icon" role="img" aria-label="[title]">
    <title>Repeat Playlist</title>
    <path d="M280-80 120-240l160-160 56 58-62 62h406v-160h80v240H274l62 62-56 58Zm-80-440v-240h486l-62-62 56-58 160 160-160 160-56-58 62-62H280v160h-80Z" />
  </svg>
);

export const RepeatOneIcon = ({ size = 20, onClick = () => { }, }) => (
  <svg onClick={onClick} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className="icon" role="img" aria-label="[title]">
    <title>Repeat One</title>
    <path d="M460-360v-180h-60v-60h120v240h-60ZM280-80 120-240l160-160 56 58-62 62h406v-160h80v240H274l62 62-56 58Zm-80-440v-240h486l-62-62 56-58 160 160-160 160-56-58 62-62H280v160h-80Z" />
  </svg>
);

export const SettingIcon = ({ size = 24, onClick = () => { } }) => {
  return (
    // <svg onClick={onClick} height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className='icon' role="img" aria-label="[title]">
    //   <title>Settings</title>
    //   <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
    // </svg>
    // <svg onClick={onClick} height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className='icon' role="img" aria-label="[title]">
    //   <title>Clear All Playlist</title>
    //   <path d="M440-120v-240h80v80h320v80H520v80h-80Zm-320-80v-80h240v80H120Zm160-160v-80H120v-80h160v-80h80v240h-80Zm160-80v-80h400v80H440Zm160-160v-240h80v80h160v80H680v80h-80Zm-480-80v-80h400v80H120Z" />
    // </svg>
    <svg onClick={onClick} height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className='icon' role="img" aria-label="[title]">
      <title>Settings</title>
      <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
    </svg>
  );
}

export const ClearIcon = ({ size = 24, onClick = () => { } }) => {
  return (
    <svg onClick={onClick} height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className='icon' role="img" aria-label="[title]">
      <title>Clear Cache</title>
      <path d="m376-300 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Zm-96 180q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520Zm-400 0v520-520Z" />
    </svg>
  )
}
