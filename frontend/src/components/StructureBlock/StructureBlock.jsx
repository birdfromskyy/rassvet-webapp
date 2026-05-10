import "./StructureBlock.scss";
import structureImg from "../../assets/structure.png";

function StructureBlock() {
  return (
    <section className="structure">
      <div className="container">

        <div className="structure__image-wrap">
          <img
            src={structureImg}
            alt="Структура организации Центра РАСсвет"
            className="structure__image"
          />
        </div>
      </div>
    </section>
  );
}

export default StructureBlock;