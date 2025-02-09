import { DeleteIcon } from "../icon"


export const Modal = ({ title = '', onClose = () => { }, children }: { title: string, onClose?: () => void, children?: React.ReactNode }) => {
  return (
    <div className='flex flex-col rounded-lg bg-toolbar w-2/3 h-1/2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
      <div className='flex justify-between items-center p-2 bg-top-panel rounded-tl-lg rounded-tr-lg'>
        <div className='h-full text-lg'>{title}</div>
        <div className='self-end flex justify-center items-center h-full'>
          <DeleteIcon size={24} onClick={onClose} />
        </div>
      </div>
      <div className='w-full p-4'>
        {children}
      </div>
    </div>
  )
}
