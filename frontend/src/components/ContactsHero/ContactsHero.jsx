import "./ContactsHero.scss";
import contactsImg from "../../assets/contacts-hero.png";

function ContactsHero() {
  return (
    <section className="contactsHero">
      <div className="container contactsHero__inner">

        <div className="contactsHero__content">
          <span className="contactsHero__badge">Контакты</span>

          <h1>Свяжитесь с нами</h1>

          <p>
            Вы можете обратиться в Центр по любым вопросам — мы всегда готовы помочь.
          </p>
        </div>

        <img src={contactsImg} alt="" className="contactsHero__image" />

      </div>
    </section>
  );
}

export default ContactsHero;