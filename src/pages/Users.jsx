import { useTranslation } from '../contexts/LanguageContext';

const Users = () => {
  const { t } = useTranslation();

  return (
    <div className="users-page">
      <h1>{t('navigation.users')} page coming soon...</h1>
      <p>This page will contain user management functionality.</p>
    </div>
  );
};

export default Users;