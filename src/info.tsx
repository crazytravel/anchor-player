import { Modal } from './components/modal.tsx';
import { MusicInfo } from './declare.ts';

import './index.css';

interface InfoProps {
  musicInfo?: MusicInfo;
  onClose: () => void;
}

function Info({ musicInfo, onClose }: InfoProps) {
  return (
    <Modal title='Track Info' onClose={onClose}>
      <div className=''>
        <div className="flex">
          <div className="w-40 text-right p-1">Codec:</div>
          <div className="p-1">{musicInfo?.codec}</div>
        </div>
        <div className="flex">
          <div className="w-40 text-right p-1">Sample Rate:</div>
          <div className="p-1">{musicInfo?.sample_rate}Hz</div>
        </div>
        <div className="flex">
          <div className="w-40 text-right p-1">Duration:</div>
          <div className="p-1">{musicInfo?.duration}</div>
        </div>
        <div className="flex">
          <div className="w-40 text-right p-1">Bits per Sample:</div>
          <div className="p-1">{musicInfo?.bits_per_sample}bit</div>
        </div>
      </div>
    </Modal>
  );
}

export default Info;
