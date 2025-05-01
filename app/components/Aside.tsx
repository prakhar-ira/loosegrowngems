import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;

  // Memoize the close handler and add logging
  const handleClose = useCallback(() => {
    console.log(`Aside (${type}): Closing via button click.`);
    close(); // This will now use the debounced close function
  }, [close, type]);

  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      document.addEventListener(
        'keydown',
        function handler(event: KeyboardEvent) {
          if (event.key === 'Escape') {
            handleClose();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [expanded, handleClose]);

  return (
    <div
      aria-modal
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
    >
      <button className="close-outside" onClick={handleClose} />
      <aside className="flex flex-col">
        <header>
          <h3>{heading}</h3>
          <button
            className="close reset"
            onClick={handleClose}
            aria-label="Close"
          >
            &times;
          </button>
        </header>
        <main className="flex-1">{children}</main>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');
  const lastCartCloseTime = useRef<number>(0);

  // Effect to lock body scroll when aside is open
  useEffect(() => {
    const body = document.body;
    if (type !== 'closed') {
      // Prevent scrolling on mount
      body.classList.add('body-aside-open');
    } else {
      // Re-enable scrolling when component unmounts
      body.classList.remove('body-aside-open');
    }

    // Cleanup function to remove class if component unmounts while open
    return () => {
      body.classList.remove('body-aside-open');
    };
  }, [type]); // Dependency array includes type state

  // Modified open function to prevent reopening cart immediately after manual close
  const openWithDebounce = useCallback((asideType: AsideType) => {
    // If trying to open cart and it was manually closed recently (within 1 second),
    // ignore the open request
    if (asideType === 'cart') {
      const now = Date.now();
      const timeSinceClose = now - lastCartCloseTime.current;
      if (timeSinceClose < 1000) {
        console.log(`Prevented cart reopening: closed ${timeSinceClose}ms ago`);
        return;
      }
    }
    setType(asideType);
  }, []);

  // Modified close function to track cart close timestamp
  const closeWithTimestamp = useCallback(() => {
    if (type === 'cart') {
      lastCartCloseTime.current = Date.now();
      console.log(`Recorded cart close at ${new Date().toISOString()}`);
    }
    setType('closed');
  }, [type]);

  return (
    <AsideContext.Provider
      value={{
        type,
        open: openWithDebounce,
        close: closeWithTimestamp,
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
