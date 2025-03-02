import Diamond from '~/assets/diamond.mp4';
import {NavLink} from '@remix-run/react';

export function ExcellenceSection() {
  return (
    <div className="excellence-section">
      <div className="excellence-container-1">
        <h1>EXCELLENCE IN ARTISTRY</h1>
        <p>
          Discover the brilliance of ethically crafted, lab-grown diamonds -
          where luxury meets sustainability.
        </p>
        <div className="excellence-buttons-container">
          <button>Shop Lab-Grown</button>
          <button>Shop Natural</button>
          <NavLink prefetch="intent" to="/pages/contact-us" end>
            Book 1:1 Appointment
          </NavLink>
        </div>
      </div>
      <div className="excellence-container-2">
        <video width="750" height="200" controls autoPlay={true} muted>
          <source src={Diamond} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
