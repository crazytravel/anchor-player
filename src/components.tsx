import { MusicError } from "./declare"
import { DeleteIcon } from "./icon"

export enum MessageType {
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning',
  SUCCESS = 'success',
}

export type MessageProps = {
  msgType?: MessageType
  message?: MusicError
  onClose?: () => void
}
export const Message = ({ msgType = MessageType.ERROR, message, onClose }: MessageProps) => {
  return (
    <div className="m-3 bg-toolbar flex items-center p-2 rounded-md">
      <div className={`alert alert-${msgType} w-60`}>
        {message?.name} : {message?.message}
      </div>
      <div>
        <DeleteIcon onClick={onClose} />
      </div>
    </div>
  )
}
