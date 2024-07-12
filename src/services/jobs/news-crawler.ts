import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
const NewsAPI = require('newsapi');

@Injectable()
export class NewsCrawlerService {
  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1PM)
  async handleCron() {
    const newsapi = new NewsAPI(process.env.NEWS_API_KEY);
    const now = new Date();
    const toDate = now.toISOString();
    const fromDate = new Date(
      now.getTime() - 24 * 60 * 60 * 1000 * 2,
    ).toISOString();
    console.log(toDate, fromDate);
    newsapi.v2
      .everything({
        q: 'tennis',
        from: fromDate,
        to: toDate,
        language: 'en',
        page: 1,
        pageSize: 10,
      })
      .then(async (response) => {
        if (response.status === 'ok') {
          console.log(response.articles);
          const news = (
            await Promise.all(
              response.articles.map(async (article) => {
                const author =
                  article.author || 'https://www.facebook.com/bbcnews';
                return {
                  image: article.urlToImage,
                  title: article.title,
                  description: article.description,
                  content: article.content,
                  createdAt: article.publishedAt,
                  author: author,
                };
              }),
            )
          ).filter(Boolean);
          console.log(news);
          await this.prismaService.news.createMany({
            data: news,
          });
        }
      });
  }
}
