import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from './components/modal';

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
    <Modal title='Settings' onClose={onClose}>
      <div className='flex w-full justify-between p-1'>
        <div className='flex justify-between items-center'>
          <div>Cache Size:</div>
          <div className='pl-4'>{cacheSize} MB</div>
        </div>
        <div>
          <button className='bg-active hover:bg-hover rounded py-1 px-2' onClick={() => clearCache()}>Clear Cache</button>
        </div>
      </div>
    </Modal >
  );
}

export default Setting;
