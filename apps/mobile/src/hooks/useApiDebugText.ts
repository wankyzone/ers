import { useEffect, useState } from 'react';

import { DEBUG_API, subscribeApiDebug } from '../config/api';

export function useApiDebugText() {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!DEBUG_API) return;

    return subscribeApiDebug((response) => {
      setText(response.text);
    });
  }, []);

  return DEBUG_API ? text : '';
}
