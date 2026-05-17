import { useState, useEffect } from "react";
import "./FinGallery.scss";
import placeholder from "../../assets/photo-placeholder.png";
import { finZoneService, getUploadUrl } from "../../services/cmsService";

const parseJson = (str, fallback = []) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

function FinGallery() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    finZoneService.getAll().then(setZones).catch(() => {});
  }, []);

  return (
    <section className="fin-gallery">
      <div className="container">
        <div className="fin-gallery__head">
          <span>Материальная база</span>
          <h2>Помещения и оборудование Центра</h2>
          <p>
            Информация сгруппирована по зонам, чтобы родителям было проще
            понять, какие условия созданы для детей.
          </p>
        </div>

        <div className="fin-gallery__grid">
          {zones.map((zone) => {
            const imgSrc = zone.image_url ? getUploadUrl(zone.image_url) : placeholder;
            return (
              <article className="fin-card" key={zone.id}>
                <div className="fin-card__images">
                  <img
                    src={imgSrc}
                    alt=""
                    onError={(e) => { e.target.src = placeholder; }}
                  />
                  <img
                    src={imgSrc}
                    alt=""
                    onError={(e) => { e.target.src = placeholder; }}
                  />
                </div>

                <div className="fin-card__content">
                  <span className="fin-card__accent">{zone.accent}</span>
                  <h3>{zone.title}</h3>

                  {zone.text && <p>{zone.text}</p>}

                  <ul>
                    {parseJson(zone.items).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        <div className="fin-gallery__final">
          <div>
            <span>Комфортная среда</span>
            <h2>
              Центр оснащён всем необходимым для развития, обучения и социальной
              адаптации детей.
            </h2>
          </div>

          <a href="/contacts" className="fin-gallery__button">
            Записаться на консультацию →
          </a>
        </div>
      </div>
    </section>
  );
}

export default FinGallery;
