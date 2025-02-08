import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DeleteIcon } from './icon';

function Setting({ onClose = () => { }, onClearCache = () => { } }) {
  const [cacheSize, setCacheSize] = useState("0")

  const clearCache = () => {
    invoke('clear_cache').then(() => {
      setCacheSize("0")
      onClearCache()
    })
  }

  useEffect(() => {
    invoke<string>('get_cache_size').then((size) => {
      setCacheSize(size)
    });
  }, [])
  return (
    <div className='flex flex-col rounded-lg bg-panel w-2/3 h-1/2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
      <div className='flex justify-between items-center p-2 bg-primary rounded-tl-lg rounded-tr-lg'>
        <div className='h-full text-lg'>Settings</div>
        <div className='self-end flex justify-center items-center h-full'>
          <DeleteIcon size={24} onClick={onClose} />
        </div>
      </div>
      <div className='flex justify-between w-full p-4'>
        <div className='flex justify-between items-center'>
          <div>Cache Size:</div>
          <div className='pl-4'>{cacheSize} MB</div>
        </div>
        <div>
          <button className='bg-active hover:bg-hover rounded py-1 px-2' onClick={() => clearCache()}>Clear Cache</button>
        </div>
      </div>
    </div>
  );
}

export default Setting;
