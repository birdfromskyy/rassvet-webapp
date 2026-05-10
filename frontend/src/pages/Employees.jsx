import Header from "../components/Header/Header";
import EmployeesHero from "../components/EmployeesHero/EmployeesHero";
import EmployeesList from "../components/EmployeesList/EmployeesList";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function Employees() {
      useEffect(() => {
      document.title = 'РАСсвет | Сотрудники'
    }, [])

  return (
    <>
      <Header />
      <EmployeesHero />
      <EmployeesList />
      <Footer />
    </>
  );
}

export default Employees;