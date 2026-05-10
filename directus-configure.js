// directus-configure.js
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

// Загружаем переменные из backend/.env
const envPath = path.resolve(__dirname, 'backend', '.env')
dotenv.config({ path: envPath })

const DIRECTUS_URL = 'http://localhost:8055'
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error(
		'❌ Ошибка: DIRECTUS_ADMIN_EMAIL и DIRECTUS_ADMIN_PASSWORD должны быть установлены в backend/.env'
	)
	process.exit(1)
}

async function configureDirectus() {
	try {
		// Получаем токен авторизации
		const authResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
			email: ADMIN_EMAIL,
			password: ADMIN_PASSWORD,
		})

		const token = authResponse.data.data.access_token
		const config = {
			headers: { Authorization: `Bearer ${token}` },
		}

		console.log('✅ Авторизация успешна')

		// Настройка видимости полей
		console.log('📝 Настройка полей для администратора...')

		// Здесь настройки полей...
	} catch (error) {
		console.error('❌ Ошибка:', error.message)
	}
}

configureDirectus()
