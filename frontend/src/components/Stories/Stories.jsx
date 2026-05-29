import { useEffect, useState } from "react";
import "./Stories.scss";

const stories = [
  {
    id: 1,
    title: "Занятия в Центре",
    cover: "https://placehold.co/300x420?text=РАСсвет",
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 2,
    title: "Сенсорная комната",
    cover: "https://placehold.co/300x420?text=Сенсорика",
    video: "https://www.w3schools.com/html/movie.mp4",
  },
  {
    id: 3,
    title: "Творческие занятия",
    cover: "https://placehold.co/300x420?text=Творчество",
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
];

function Stories() {
  const [activeIndex, setActiveIndex] = useState(null);

  const activeStory = activeIndex !== null ? stories[activeIndex] : null;

  const closeStory = () => setActiveIndex(null);

  const nextStory = () => {
    setActiveIndex((prev) =>
      prev === stories.length - 1 ? 0 : prev + 1
    );
  };

  const prevStory = () => {
    setActiveIndex((prev) =>
      prev === 0 ? stories.length - 1 : prev - 1
    );
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeIndex === null) return;

      if (e.key === "Escape") closeStory();
      if (e.key === "ArrowRight") nextStory();
      if (e.key === "ArrowLeft") prevStory();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex]);

  return (
    <section className="stories">
      <div className="container">

        <div className="stories__row">
          {stories.map((story, index) => (
            <button
              className="story-preview"
              key={story.id}
              type="button"
              onClick={() => setActiveIndex(index)}
            >
              <img src={story.cover} alt="" />
              <span>{story.title}</span>
            </button>
          ))}
        </div>
      </div>

      {activeStory && (
        <div className="stories-modal">
          <button
            className="stories-modal__close"
            type="button"
            onClick={closeStory}
            aria-label="Закрыть"
          >
            ×
          </button>

          <button
            className="stories-modal__nav stories-modal__nav--left"
            type="button"
            onClick={prevStory}
            aria-label="Предыдущая история"
          >
            ←
          </button>

          <div className="stories-modal__card">
            <div className="stories-modal__progress">
              {stories.map((story, index) => (
                <span
                  key={story.id}
                  className={index <= activeIndex ? "is-active" : ""}
                />
              ))}
            </div>

            <video
              key={activeStory.id}
              src={activeStory.video}
              controls
              autoPlay
              playsInline
            />

            <div className="stories-modal__caption">
              {activeStory.title}
            </div>
          </div>

          <button
            className="stories-modal__nav stories-modal__nav--right"
            type="button"
            onClick={nextStory}
            aria-label="Следующая история"
          >
            →
          </button>
        </div>
      )}
    </section>
  );
}

export default Stories;