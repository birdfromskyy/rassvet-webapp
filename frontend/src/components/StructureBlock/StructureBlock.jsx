import { useState, useEffect } from "react";
import "./StructureBlock.scss";
import structureImg from "../../assets/structure.png";
import { siteSettingService, getUploadUrl } from "../../services/cmsService";

function StructureBlock() {
  const [imgSrc, setImgSrc] = useState(structureImg);

  useEffect(() => {
    siteSettingService.getByKey("structure_photo_url")
      .then(({ value }) => { if (value) setImgSrc(getUploadUrl(value)); })
      .catch(() => {});
  }, []);

  return (
    <section className="structure">
      <div className="container">
        <div className="structure__image-wrap">
          <img
            src={imgSrc}
            alt="Структура организации Центра РАСсвет"
            className="structure__image"
            onError={(e) => { e.target.src = structureImg; }}
          />
        </div>
      </div>
    </section>
  );
}

export default StructureBlock;
