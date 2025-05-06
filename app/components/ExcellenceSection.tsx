import {Link, NavLink} from '@remix-run/react';

import HeaderImage from '~/assets/header-image.png';

export function ExcellenceSection() {
  return (
    <div className="excellence-section">
      <div className="excellence-container-1">
        <h1 className="women-know-text">WOMEN KNOW<br />DIAMONDS</h1>
        <p className="font-light">
          Discover the brilliance of ethically crafted, lab-grown diamonds
          <br className="hidden md:block" />
          - where luxury meets sustainability.
        </p>
        <div className="excellence-buttons-container">
          {/* <Link to="/collections/diamonds">
            <button>Shop Diamonds</button>
          </Link> */}
          <Link   to="/pages/contact-us">
            <button>Book 1:1 Appointment</button>
          </Link>
          {/* <NavLink 
            prefetch="intent" 
            to="/pages/contact-us" 
            end
            className="relative inline-block text-base after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-black after:transition-all after:duration-300 hover:after:w-full"
          >
            Book 1:1 Appointment
          </NavLink> */}
        </div>
      </div>
      <div className="excellence-container-2">
        <img 
          src={HeaderImage} 
          alt="Beautiful diamond jewelry" 
          width="750" 
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
}
