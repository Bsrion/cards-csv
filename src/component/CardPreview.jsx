import { useState } from "react";
import "./CardPreview.css";

export default function CardPreview({ isVisible }) {
  const imgSrc = `${import.meta.env.BASE_URL}master_card_digital.png`;
  // const [isVisible, setIsVisible] = useState(false); // start visible

  return (
    isVisible || (
      <div className="image_container">
        <div className="imageWrapper">
          <span className="closeCardPreview" onClick={() => !isVisible}>
            ✗
          </span>

          <img className="imagePng" src={imgSrc} alt="imageTemplate" />
        </div>
      </div>
    )
  );
}
