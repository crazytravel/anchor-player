import { MusicInfo } from '../declare.ts';
import { DeleteIcon } from '../icon.tsx';

import './index.css';

interface InfoProps {
  musicInfo?: MusicInfo;
  onClick: () => void;
}

function Info({ musicInfo, onClick }: InfoProps) {
  return (
    <div className='flex flex-col rounded-lg bg-panel w-2/3 h-1/2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
      <div className='flex justify-between items-center p-2 bg-primary rounded-tl-lg rounded-tr-lg'>
        <div className='h-full text-lg'>Information</div>
        <div className='self-end flex justify-center items-center h-full'>
          <DeleteIcon size={24} onClick={onClick} />
        </div>
      </div>
      <div className='p-2'>
        <div className="row">
          <div className="label">Codec:</div>
          <div className="col">{musicInfo?.codec}</div>
        </div>
        <div className="row">
          <div className="label">Sample Rate:</div>
          <div className="col">{musicInfo?.sample_rate}Hz</div>
        </div>
        {/*<div className="row">*/}
        {/*    <div className="label">Start Time:</div>*/}
        {/*    <div className="col">{musicInfo?.start_time}</div>*/}
        {/*</div>*/}
        <div className="row">
          <div className="label">Duration:</div>
          <div className="col">{musicInfo?.duration}</div>
        </div>
        {/*<div className="row">*/}
        {/*    <div className="label">Frames:</div>*/}
        {/*    <div className="col">{musicInfo?.frames}</div>*/}
        {/*</div>*/}
        <div className="row">
          <div className="label">Time Base:</div>
          <div className="col">{musicInfo?.time_base}</div>
        </div>
        {/*<div className="row">*/}
        {/*    <div className="label">Encoder Delay:</div>*/}
        {/*    <div className="col">{musicInfo?.encoder_delay}</div>*/}
        {/*</div>*/}
        {/*<div className="row">*/}
        {/*    <div className="label">Encoder Padding:</div>*/}
        {/*    <div className="col">{musicInfo?.encoder_padding}</div>*/}
        {/*</div>*/}
        {/*<div className="row">*/}
        {/*    <div className="label">Sample Format:</div>*/}
        {/*    <div className="col">{musicInfo?.sample_format}</div>*/}
        {/*</div>*/}
        <div className="row">
          <div className="label">Bits per Sample:</div>
          <div className="col">{musicInfo?.bits_per_sample}bit</div>
        </div>
        {/* <div className="row">
        <div className="label">Channel:</div>
        <div className="col">{musicInfo?.channel}</div>
      </div> */}
        {/*<div className="row">*/}
        {/*    <div className="label">Channel Map:</div>*/}
        {/*    <div className="col">{musicInfo?.channel_map}</div>*/}
        {/*</div>*/}
        {/*<div className="row">*/}
        {/*    <div className="label">Channel Layout:</div>*/}
        {/*    <div className="col">{musicInfo?.channel_layout}</div>*/}
        {/*</div>*/}
        {/*<div className="row">*/}
        {/*    <div className="label">Language:</div>*/}
        {/*    <div className="col">{musicInfo?.language}</div>*/}
        {/*</div>*/}
      </div>
    </div>
  );
}

export default Info;
