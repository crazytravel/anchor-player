import {MusicInfo} from "../declare.ts";

import "./index.css";

interface InfoProps {
    musicInfo?: MusicInfo;
    onClick: () => void;
    className?: string;
}

function Info({musicInfo, onClick, className}: InfoProps) {
  return (
      <div className={className}>
          <div className="info-bar">
              <span onClick={onClick}>x</span>
          </div>
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
          <div className="row">
              <div className="label">Channel:</div>
              <div className="col">{musicInfo?.channel}</div>
          </div>
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
  );
}

export default Info;